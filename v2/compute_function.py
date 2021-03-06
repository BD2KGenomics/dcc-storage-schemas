import boto3 as b
import pytz as p
import os
from decimal import Decimal
import datetime as dt


def calculate_compute_cost(start_time, end_time, instance_type, region_name, instance_description='Linux/UNIX',
                           availability_zone='us-west-2b'):
    if (not instance_type):
        return ("No instance_type specified!")

    elif (not region_name):
        return ("No region_name specified!")

    elif (not start_time or not end_time):
        return ("Specify start_time and end_time!\nWith format yyyy-mm-ddTHH:MM:SS.MSS")
    else:
        try:
            # Set up time
            startDatetime = dt.datetime.strptime(start_time, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=p.UTC)
            endDatetime = dt.datetime.strptime(end_time, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=p.UTC) + dt.timedelta(
                hours=2)
            block = dt.datetime.strptime(end_time, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=p.UTC)

        except:
            s = start_time[:-6]
            e = end_time[:-6]
            startDatetime = dt.datetime.strptime(s, "%Y-%m-%d %H:%M:%S.%f").replace(tzinfo=p.UTC)
            endDatetime = dt.datetime.strptime(e, "%Y-%m-%d %H:%M:%S.%f").replace(tzinfo=p.UTC) + dt.timedelta(hours=2)
            block = dt.datetime.strptime(e, "%Y-%m-%d %H:%M:%S.%f").replace(tzinfo=p.UTC)

        # Set up infrastructure for making calls to aws, with the desired parameters.
        client = b.client('ec2', region_name=region_name,
                          aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
                          aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"])
        client.meta.events._unique_id_handlers['retry-config-ec2']['handler']._checker.__dict__['_max_attempts'] = 20
        response = client.describe_spot_price_history(AvailabilityZone=availability_zone, MaxResults=999,
                                                      InstanceTypes=[str(instance_type)], StartTime=startDatetime,
                                                      EndTime=endDatetime,
                                                      ProductDescriptions=[str(instance_description)])

        last_time_checked = response
        price = 0
        # Iterate in linear order of time, response returns [n, n-1, n-2, ..., 0]
        for spot_price in reversed(response['SpotPriceHistory']):
            # Record of first spot history that qualifies for calculation.
            if (spot_price['Timestamp'] < startDatetime):
                last_time_checked = spot_price
                if (len(response["SpotPriceHistory"]) <= 1):
                    delta = startDatetime - block
                    minutes = float(delta.seconds) / float(60)
                    rate = (float(minutes) / float(60)) * float(last_time_checked['SpotPrice'])
                    price += Decimal(rate)
            # Spot history post starting time
            elif ((spot_price['Timestamp'] >= startDatetime) and (spot_price['Timestamp'] < block)):
                last_time_checked = last_time_checked['SpotPriceHistory'][-1] \
                    if 'Timestamp' not in last_time_checked else last_time_checked
                # Spot price change in between start time.
                if ((startDatetime <= spot_price['Timestamp']) and (startDatetime >= last_time_checked['Timestamp'])):
                    delta = startDatetime - last_time_checked['Timestamp']
                    minutes = float(delta.seconds) / float(60)
                    rate = (float(minutes) / float(60)) * float(last_time_checked['SpotPrice'])
                    price += Decimal(rate)
                    last_time_checked = spot_price
                # Consecutive calculator 1, 2, 3, ..., n.
                elif ((startDatetime < last_time_checked['Timestamp']) and (
                    spot_price['Timestamp'] > last_time_checked['Timestamp'])):
                    delta = spot_price['Timestamp'] - last_time_checked['Timestamp']
                    minutes = float(delta.seconds) / float(60)
                    rate = (float(minutes) / float(60)) * float(last_time_checked['SpotPrice'])
                    price += Decimal(rate)
                    last_time_checked = spot_price
                # Handles edge case, no record return from starting time.
                elif ((startDatetime <= spot_price['Timestamp']) and (spot_price['Timestamp'] == last_time_checked['Timestamp'])):
                    delta = last_time_checked['Timestamp'] - startDatetime
                    minutes = float(delta.seconds) / float(60)
                    rate = (float(minutes) / float(60)) * float(last_time_checked['SpotPrice'])
                    price += Decimal(rate)
                    last_time_checked = spot_price
            # Closing calculation, ending time and last spot-price that qualifies for calculation.
            elif ((last_time_checked['Timestamp'] <= block) and (spot_price['Timestamp'] > block)):
                delta = block - last_time_checked['Timestamp']
                minutes = float(delta.seconds) / float(60)
                rate = (float(minutes) / float(60)) * float(last_time_checked['SpotPrice'])
                price += Decimal(rate)
                last_time_checked = spot_price

        return price
